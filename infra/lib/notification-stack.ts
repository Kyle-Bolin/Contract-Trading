import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { NotificationStackProps } from './shared-props';

export class NotificationStack extends cdk.Stack {
  public readonly alertTopic: sns.Topic;
  public readonly emailTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: NotificationStackProps) {
    super(scope, id, props);

    // SNS topic for contract alerts (new awards, modifications, etc.)
    this.alertTopic = new sns.Topic(this, 'ContractAlertTopic', {
      topicName: `contract-trading-alerts-${props.stageName}`,
      displayName: 'Contract Trading Alerts',
    });

    // SNS topic for email notifications to users
    this.emailTopic = new sns.Topic(this, 'EmailNotificationTopic', {
      topicName: `contract-trading-email-${props.stageName}`,
      displayName: 'Contract Trading Email Notifications',
    });

    // Outputs
    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: this.alertTopic.topicArn,
    });
    new cdk.CfnOutput(this, 'EmailTopicArn', {
      value: this.emailTopic.topicArn,
    });
  }
}
