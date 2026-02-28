import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sns from 'aws-cdk-lib/aws-sns';

export interface EnvironmentConfig {
  account: string;
  region: string;
  domainName: string;
  stageName: string;
}

export interface SharedStackProps extends cdk.StackProps {
  stageName: string;
}

export interface AuthStackProps extends SharedStackProps {
  // Populated after NetworkStack is created
}

export interface DataStackProps extends SharedStackProps {
  // Populated after AuthStack is created
}

export interface ApiStackProps extends SharedStackProps {
  userPool: cognito.IUserPool;
  tables: Record<string, dynamodb.ITable>;
  alertTopic: sns.ITopic;
}

export interface NotificationStackProps extends SharedStackProps {
  // No cross-stack dependencies
}

export interface SchedulerStackProps extends SharedStackProps {
  alertTopic: sns.ITopic;
}
