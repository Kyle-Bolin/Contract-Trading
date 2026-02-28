import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { SchedulerStackProps } from './shared-props';

export class SchedulerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SchedulerStackProps) {
    super(scope, id, props);

    // Placeholder Lambda for daily contract polling
    const pollerHandler = new lambda.Function(this, 'ContractPollerHandler', {
      functionName: `contract-trading-poller-${props.stageName}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(
        'exports.handler = async () => { console.log("Polling USAspending.gov for new contracts..."); return { statusCode: 200 }; };',
      ),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        STAGE: props.stageName,
        ALERT_TOPIC_ARN: props.alertTopic.topicArn,
      },
    });

    // Grant publish access to alert topic
    props.alertTopic.grantPublish(pollerHandler);

    // EventBridge rule — runs daily at 6 AM UTC (after market data is available)
    const dailyRule = new events.Rule(this, 'DailyPollingRule', {
      ruleName: `contract-trading-daily-poll-${props.stageName}`,
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '6',
        day: '*',
        month: '*',
        year: '*',
      }),
      description: 'Daily polling of USAspending.gov for new contract awards',
    });

    dailyRule.addTarget(new targets.LambdaFunction(pollerHandler));

    // Outputs
    new cdk.CfnOutput(this, 'PollerFunctionName', {
      value: pollerHandler.functionName,
    });
    new cdk.CfnOutput(this, 'DailyRuleName', {
      value: dailyRule.ruleName,
    });
  }
}
