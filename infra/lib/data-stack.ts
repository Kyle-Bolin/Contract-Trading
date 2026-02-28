import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { DataStackProps } from './shared-props';

export class DataStack extends cdk.Stack {
  public readonly tables: Record<string, dynamodb.Table>;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    this.tables = {};

    const commonTags = {
      Project: 'ContractTrading',
      Stage: props.stageName,
      ManagedBy: 'CDK',
    };

    // ── ContractAwards table ────────────────────────────────────────
    const contractAwards = new dynamodb.Table(this, 'ContractAwardsTable', {
      tableName: `contract-trading-awards-${props.stageName}`,
      partitionKey: { name: 'awardId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'awardDate', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: props.stageName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    contractAwards.addGlobalSecondaryIndex({
      indexName: 'ByRecipient',
      partitionKey: { name: 'recipientName', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'awardDate', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    contractAwards.addGlobalSecondaryIndex({
      indexName: 'ByTicker',
      partitionKey: { name: 'ticker', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'awardDate', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    contractAwards.addGlobalSecondaryIndex({
      indexName: 'ByNaics',
      partitionKey: { name: 'naicsCode', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'awardDate', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    cdk.Tags.of(contractAwards).add('Table', 'ContractAwards');
    for (const [key, value] of Object.entries(commonTags)) {
      cdk.Tags.of(contractAwards).add(key, value);
    }
    this.tables['contractAwards'] = contractAwards;

    // ── Companies table ─────────────────────────────────────────────
    const companies = new dynamodb.Table(this, 'CompaniesTable', {
      tableName: `contract-trading-companies-${props.stageName}`,
      partitionKey: { name: 'companyName', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: props.stageName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    cdk.Tags.of(companies).add('Table', 'Companies');
    for (const [key, value] of Object.entries(commonTags)) {
      cdk.Tags.of(companies).add(key, value);
    }
    this.tables['companies'] = companies;

    // ── UserWatchlists table ────────────────────────────────────────
    const userWatchlists = new dynamodb.Table(this, 'UserWatchlistsTable', {
      tableName: `contract-trading-watchlists-${props.stageName}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'ticker', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: props.stageName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    cdk.Tags.of(userWatchlists).add('Table', 'UserWatchlists');
    for (const [key, value] of Object.entries(commonTags)) {
      cdk.Tags.of(userWatchlists).add(key, value);
    }
    this.tables['userWatchlists'] = userWatchlists;

    // ── UserFilters table ───────────────────────────────────────────
    const userFilters = new dynamodb.Table(this, 'UserFiltersTable', {
      tableName: `contract-trading-filters-${props.stageName}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'filterId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: props.stageName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    cdk.Tags.of(userFilters).add('Table', 'UserFilters');
    for (const [key, value] of Object.entries(commonTags)) {
      cdk.Tags.of(userFilters).add(key, value);
    }
    this.tables['userFilters'] = userFilters;

    // ── Alerts table ────────────────────────────────────────────────
    const alerts = new dynamodb.Table(this, 'AlertsTable', {
      tableName: `contract-trading-alerts-${props.stageName}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'alertTimestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: props.stageName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    alerts.addGlobalSecondaryIndex({
      indexName: 'ByAward',
      partitionKey: { name: 'awardId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    cdk.Tags.of(alerts).add('Table', 'Alerts');
    for (const [key, value] of Object.entries(commonTags)) {
      cdk.Tags.of(alerts).add(key, value);
    }
    this.tables['alerts'] = alerts;

    // ── CfnOutputs ─────────────────────────────────────────────────
    for (const [name, table] of Object.entries(this.tables)) {
      new cdk.CfnOutput(this, `${name}TableName`, {
        value: table.tableName,
        exportName: `${props.stageName}-${name}-tableName`,
      });
      new cdk.CfnOutput(this, `${name}TableArn`, {
        value: table.tableArn,
        exportName: `${props.stageName}-${name}-tableArn`,
      });
    }
  }
}
