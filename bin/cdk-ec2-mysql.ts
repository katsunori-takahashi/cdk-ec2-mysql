#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkEc2MysqlStack } from '../lib/cdk-ec2-mysql-stack';

const app = new cdk.App();
new CdkEc2MysqlStack(app, 'CdkEc2MysqlStack');
