// Copyright 2016-2025, Pulumi Corporation.  All rights reserved.
import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';

// Define common tags
const commonTags = {
  Environment: 'Dev',
  Project: 'aws-ts-hello-fargate',
};
// Note: this will not tag everything - see: https://github.com/pulumi/pulumi/issues/10428#issuecomment-1219601303

// Create an ECS Fargate cluster.
const cluster = new awsx.classic.ecs.Cluster('cluster', {
  tags: commonTags,
});

// Create a CloudWatch Log Group
const logGroup = new aws.cloudwatch.LogGroup('aws-ts-hello-fargate-log-group', {
  retentionInDays: 1,
});

// Define the Networking for our service.
const alb = new awsx.classic.lb.ApplicationLoadBalancer('net-lb', {
  external: true,
  securityGroups: cluster.securityGroups,
  tags: commonTags,
});
const web = alb.createListener('web', {
  port: 80,
  external: true,
});

// Create a repository for container images.
const repo = new awsx.ecr.Repository('repo', {
  forceDelete: true,
  tags: commonTags,
});

// Build and publish a Docker image to a private ECR registry.
const img = new awsx.ecr.Image('app-img', {
  repositoryUrl: repo.url,
  context: './app',
  platform: 'linux/amd64', // Force AMD64 architecture (needed for apple silicon)
});

// Create a Fargate service task that can scale out.
const appService = new awsx.classic.ecs.FargateService('app-svc', {
  cluster,
  taskDefinitionArgs: {
    logGroup: logGroup,
    container: {
      image: img.imageUri,
      cpu: 102 /*10% of 1024*/,
      memory: 50 /*MB*/,
      portMappings: [web],
      logConfiguration: {
        logDriver: 'awslogs',
        options: {
          'awslogs-group': logGroup.name,
          'awslogs-region': aws.config.region!,
          'awslogs-stream-prefix': 'hello',
        },
      },
    },
  },
  desiredCount: 5,
  tags: commonTags,
});

// Export the Internet address for the service.
export const url = web.endpoint.hostname;
