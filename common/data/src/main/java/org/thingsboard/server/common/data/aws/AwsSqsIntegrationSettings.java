// SPDX-FileCopyrightText: Copyright The ThingsBoard Authors
// SPDX-License-Identifier: Apache-2.0
package org.thingsboard.server.common.data.aws;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema
public class AwsSqsIntegrationSettings {

    @JsonProperty("enabled")
    @Schema(description = "Whether the AWS SQS integration is enabled")
    private boolean enabled = false;

    @JsonProperty("region")
    @Schema(description = "AWS region for the SQS queue (e.g., us-east-1)")
    private String region;

    @JsonProperty("accessKeyId")
    @Schema(description = "AWS Access Key ID (will be masked in responses)")
    private String accessKeyId;

    @JsonProperty("secretAccessKey")
    @Schema(description = "AWS Secret Access Key (will be masked in responses)")
    private String secretAccessKey;

    @JsonProperty("queueName")
    @Schema(description = "Name of the SQS queue")
    private String queueName;

    @JsonProperty("queueUrl")
    @Schema(description = "Full URL of the SQS queue (optional, can derive from name)")
    private String queueUrl;

    @JsonProperty("queueType")
    @Schema(description = "Queue type: STANDARD or FIFO")
    private String queueType = "STANDARD";

    @JsonProperty("messageGroupId")
    @Schema(description = "Message group ID for FIFO queues")
    private String messageGroupId;

    @JsonProperty("deduplicationId")
    @Schema(description = "Deduplication ID for FIFO queues with deduplication")
    private String deduplicationId;

    @JsonProperty("endpointOverride")
    @Schema(description = "Optional endpoint override for custom/local SQS services")
    private String endpointOverride;

    @JsonProperty("messageVisibilityTimeout")
    @Schema(description = "Message visibility timeout in seconds (0-43200)")
    private Integer messageVisibilityTimeout = 30;

    @JsonProperty("pollingWaitTime")
    @Schema(description = "Long polling wait time in seconds (0-20)")
    private Integer pollingWaitTime = 20;

    @JsonProperty("maxMessagesPerPoll")
    @Schema(description = "Maximum number of messages to receive per poll (1-10)")
    private Integer maxMessagesPerPoll = 10;

    @JsonProperty("retryMaxAttempts")
    @Schema(description = "Maximum number of retry attempts")
    private Integer retryMaxAttempts = 3;

    @JsonProperty("retryBackoffMs")
    @Schema(description = "Retry backoff time in milliseconds")
    private Integer retryBackoffMs = 100;

    @Override
    public String toString() {
        // Don't log sensitive credentials
        return "AwsSqsIntegrationSettings{" +
                "enabled=" + enabled +
                ", region='" + region + '\'' +
                ", queueName='" + queueName + '\'' +
                ", queueUrl='" + queueUrl + '\'' +
                ", queueType='" + queueType + '\'' +
                ", messageVisibilityTimeout=" + messageVisibilityTimeout +
                ", pollingWaitTime=" + pollingWaitTime +
                ", maxMessagesPerPoll=" + maxMessagesPerPoll +
                '}';
    }
}
