import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as path from 'path';
import { Construct } from 'constructs';
import { AuthStackProps } from './shared-props';

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const callbackUrls = this.node.tryGetContext('callbackUrls') ?? [
      'http://localhost:3000/api/auth/callback',
    ];
    const logoutUrls = this.node.tryGetContext('logoutUrls') ?? [
      'http://localhost:3000/',
    ];
    const cognitoDomainPrefix =
      this.node.tryGetContext('cognitoDomainPrefix') ??
      `contract-trading-${props.stageName}`;

    // Pre sign-up trigger Lambda
    const preSignUpFn = new lambdaNode.NodejsFunction(this, 'PreSignUpFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas', 'pre-signup', 'index.ts'),
      bundling: {
        minify: true,
        sourceMap: true,
      },
      timeout: cdk.Duration.seconds(10),
    });

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `contract-trading-users-${props.stageName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { required: true, mutable: true },
        familyName: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy:
        props.stageName === 'prod'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      lambdaTriggers: {
        preSignUp: preSignUpFn,
      },
    });

    // Secrets Manager references for Google OAuth credentials
    const googleClientId = secretsmanager.Secret.fromSecretNameV2(
      this,
      'GoogleClientId',
      'contract-trading/google-oauth/client-id',
    );
    const googleClientSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'GoogleClientSecret',
      'contract-trading/google-oauth/client-secret',
    );

    // Secrets Manager references for Apple Sign-In credentials
    const appleTeamId = secretsmanager.Secret.fromSecretNameV2(
      this,
      'AppleTeamId',
      'contract-trading/apple-signin/team-id',
    );
    const appleKeyId = secretsmanager.Secret.fromSecretNameV2(
      this,
      'AppleKeyId',
      'contract-trading/apple-signin/key-id',
    );
    const applePrivateKey = secretsmanager.Secret.fromSecretNameV2(
      this,
      'ApplePrivateKey',
      'contract-trading/apple-signin/private-key',
    );

    // Google Identity Provider
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(
      this,
      'GoogleProvider',
      {
        userPool: this.userPool,
        clientId: googleClientId.secretValue.unsafeUnwrap(),
        clientSecretValue: googleClientSecret.secretValue,
        scopes: ['openid', 'profile', 'email'],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
          familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
          profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
        },
      },
    );

    // Apple Identity Provider
    const appleProvider = new cognito.UserPoolIdentityProviderApple(
      this,
      'AppleProvider',
      {
        userPool: this.userPool,
        clientId: 'com.contracttrading.auth',
        teamId: appleTeamId.secretValue.unsafeUnwrap(),
        keyId: appleKeyId.secretValue.unsafeUnwrap(),
        privateKeyValue: applePrivateKey.secretValue,
        scopes: ['email', 'name'],
        attributeMapping: {
          email: cognito.ProviderAttribute.APPLE_EMAIL,
          givenName: cognito.ProviderAttribute.APPLE_FIRST_NAME,
          familyName: cognito.ProviderAttribute.APPLE_LAST_NAME,
        },
      },
    );

    // App Client with OAuth configuration
    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: `contract-trading-web-${props.stageName}`,
      generateSecret: false,
      authFlows: {
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls,
        logoutUrls,
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE,
        cognito.UserPoolClientIdentityProvider.APPLE,
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      preventUserExistenceErrors: true,
    });

    // Prevent CDK race conditions: ensure providers are created before the client
    this.userPoolClient.node.addDependency(googleProvider);
    this.userPoolClient.node.addDependency(appleProvider);

    // Cognito domain
    const domain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: cognitoDomainPrefix,
      },
    });

    // Grant the pre-signup Lambda permission to list and link users
    this.userPool.grant(preSignUpFn, 'cognito-idp:ListUsers');
    this.userPool.grant(
      preSignUpFn,
      'cognito-idp:AdminLinkProviderForUser',
    );

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: domain.domainName,
    });
  }
}
