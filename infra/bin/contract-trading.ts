#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { AuthStack } from '../lib/auth-stack';
import { DataStack } from '../lib/data-stack';
import { ApiStack } from '../lib/api-stack';
import { NotificationStack } from '../lib/notification-stack';
import { SchedulerStack } from '../lib/scheduler-stack';
import { EnvironmentConfig } from '../lib/shared-props';

const app = new cdk.App();

// Determine target environment from context (default to dev)
const targetEnv = app.node.tryGetContext('env') || 'dev';
const environments: Record<string, EnvironmentConfig> =
  app.node.tryGetContext('environments');

const envConfig = environments?.[targetEnv] ?? {
  account: process.env.CDK_DEFAULT_ACCOUNT ?? '123456789012',
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  domainName: '',
  stageName: targetEnv,
};

const stageName = envConfig.stageName;
const env: cdk.Environment = {
  account: envConfig.account,
  region: envConfig.region,
};

const prefix = `ContractTrading-${stageName}`;

// Network stack (S3 + CloudFront)
const networkStack = new NetworkStack(app, `${prefix}-Network`, {
  env,
  stageName,
});

// Notification stack (SNS topics) — no dependencies
const notificationStack = new NotificationStack(
  app,
  `${prefix}-Notification`,
  {
    env,
    stageName,
  },
);

// Auth stack (Cognito)
const authStack = new AuthStack(app, `${prefix}-Auth`, {
  env,
  stageName,
});

// Data stack (DynamoDB)
const dataStack = new DataStack(app, `${prefix}-Data`, {
  env,
  stageName,
});

// API stack (API Gateway + Lambda) — depends on Auth, Data, Notification
const apiStack = new ApiStack(app, `${prefix}-Api`, {
  env,
  stageName,
  userPool: authStack.userPool,
  tables: dataStack.tables,
  alertTopic: notificationStack.alertTopic,
});
apiStack.addDependency(authStack);
apiStack.addDependency(dataStack);
apiStack.addDependency(notificationStack);

// Scheduler stack (EventBridge + Lambda) — depends on Notification
const schedulerStack = new SchedulerStack(app, `${prefix}-Scheduler`, {
  env,
  stageName,
  alertTopic: notificationStack.alertTopic,
});
schedulerStack.addDependency(notificationStack);

app.synth();
