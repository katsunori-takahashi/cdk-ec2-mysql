import {Stack, Construct, RemovalPolicy, SecretValue, Duration} from "@aws-cdk/core";
import {IVpc, InstanceType, InstanceClass, InstanceSize, SubnetType, SecurityGroup, Vpc, ISecurityGroup} from "@aws-cdk/aws-ec2";
import {Credentials, DatabaseInstance, DatabaseInstanceEngine, MysqlEngineVersion, StorageType} from "@aws-cdk/aws-rds";
import * as cdk from "@aws-cdk/core";
import {StringParameter} from "@aws-cdk/aws-ssm";
import {RetentionDays} from "@aws-cdk/aws-logs";
import {ComparisonOperator} from '@aws-cdk/aws-cloudwatch';

interface rdsContext {
  "vpcId": string,
  "rdsSecurityGroupId": string
  "rdsInstanceIdentifier": string,
  "rdsDatabaseName": string,
  "rdsMultiAz": boolean,
  "availabilityZone": string
  "rdsBackupRetentionDay": number,
  "deletionProtection": boolean,
  "cpuAlarmEvaluationPeriods": number,
  "cpuAlarmThreshold": number
}

export class RdsStack extends Stack {
  private context: rdsContext;
  private readonly vpc: IVpc;
  private readonly rdsSecurityGroup: ISecurityGroup;
  private readonly credentials: Credentials;
  public readonly rdsInstance: DatabaseInstance;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.context = this.node.tryGetContext(this.stackName);
    this.vpc = this.getVpc();
    this.credentials = this.createCredentials();
    this.rdsSecurityGroup = this.getRdsSecurityGroup();
    this.rdsInstance = this.createRds();
    this.setAlarms();
  }

  private getVpc(): IVpc {
    return Vpc.fromLookup(this, 'Vpc', {
      vpcId: this.context.vpcId
    });
  }

  private getRdsSecurityGroup(): ISecurityGroup {
    return SecurityGroup.fromLookup(this, 'RdsSecurityGroup', this.context.rdsSecurityGroupId);
  }

  private createCredentials(): Credentials {
    const user = StringParameter.valueForStringParameter(this, this.stackName + '_USER_NAME', 1);
    return Credentials.fromPassword(user, SecretValue.ssmSecure(this.stackName + '_USER_PASSWORD', '1'));
  }

  private createRds() {
    return new DatabaseInstance(this, this.stackName + '-RdsInstance', {
      engine: DatabaseInstanceEngine.mysql({
        version: MysqlEngineVersion.VER_5_7
      }),
      instanceIdentifier: this.context.rdsInstanceIdentifier,
      databaseName: this.context.rdsDatabaseName,
      instanceType: InstanceType.of(
          InstanceClass.T3,
          InstanceSize.MICRO
      ),
      credentials: this.credentials,
      storageType: StorageType.GP2,
      allocatedStorage: 20,
      maxAllocatedStorage: 200,
      multiAz: this.context.rdsMultiAz,
      vpc: this.vpc,
      port: 3306,
      backupRetention: Duration.days(this.context.rdsBackupRetentionDay),
      storageEncrypted: true,
      autoMinorVersionUpgrade: false,
      deletionProtection: this.context.deletionProtection,
      removalPolicy: RemovalPolicy.DESTROY,
      availabilityZone: this.context.availabilityZone,
      securityGroups: [
        this.rdsSecurityGroup
      ],
      vpcSubnets: {
        subnetType: SubnetType.ISOLATED
      },
      cloudwatchLogsExports: ['error', 'slowquery', 'audit'],
      cloudwatchLogsRetention: RetentionDays.ONE_MONTH
    })
  }

  private setAlarms(): void {
    const cpuMetric = this.rdsInstance.metricCPUUtilization({
      statistic: "Average"
    })
    cpuMetric.createAlarm(this, 'HighCPU', {
      evaluationPeriods: this.context.cpuAlarmEvaluationPeriods,
      threshold: this.context.cpuAlarmThreshold,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
    })
  }
}