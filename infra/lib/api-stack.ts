import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { ApiStackProps } from './shared-props';

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // REST API
    this.api = new apigateway.RestApi(this, 'ContractTradingApi', {
      restApiName: `contract-trading-api-${props.stageName}`,
      description: 'Contract Trading Platform API',
      deployOptions: {
        stageName: props.stageName,
        throttlingBurstLimit: 50,
        throttlingRateLimit: 100,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
        ],
      },
    });

    // Cognito authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      'CognitoAuthorizer',
      {
        cognitoUserPools: [props.userPool as cognito.UserPool],
        authorizerName: `contract-trading-authorizer-${props.stageName}`,
      },
    );

    // Placeholder Lambda for contract endpoints
    const contractsHandler = new lambda.Function(this, 'ContractsHandler', {
      functionName: `contract-trading-contracts-${props.stageName}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(
        'exports.handler = async () => ({ statusCode: 200, body: JSON.stringify({ message: "contracts endpoint placeholder" }) });',
      ),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        STAGE: props.stageName,
        ALERT_TOPIC_ARN: props.alertTopic.topicArn,
      },
    });

    // Grant Lambda read access to DynamoDB tables
    for (const table of Object.values(props.tables)) {
      table.grantReadData(contractsHandler);
    }

    // Grant Lambda publish access to alert topic
    props.alertTopic.grantPublish(contractsHandler);

    // Placeholder Lambda for signals endpoints
    const signalsHandler = new lambda.Function(this, 'SignalsHandler', {
      functionName: `contract-trading-signals-${props.stageName}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(
        'exports.handler = async () => ({ statusCode: 200, body: JSON.stringify({ message: "signals endpoint placeholder" }) });',
      ),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        STAGE: props.stageName,
      },
    });

    for (const table of Object.values(props.tables)) {
      table.grantReadData(signalsHandler);
    }

    // API resources
    const contractsResource = this.api.root.addResource('contracts');
    contractsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(contractsHandler),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    );

    const signalsResource = this.api.root.addResource('signals');
    signalsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(signalsHandler),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    );

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
    });
  }
}
