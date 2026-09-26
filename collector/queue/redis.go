package queue

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisQueue manages Redis Streams interactions
type RedisQueue struct {
	client     *redis.Client
	streamName string
	groupName  string
}

// NewRedisQueue initializes a stream queue
func NewRedisQueue(client *redis.Client, streamName string, groupName string) *RedisQueue {
	return &RedisQueue{
		client:     client,
		streamName: streamName,
		groupName:  groupName,
	}
}

// EnsureConsumerGroup creates the stream consumer group if it does not already exist
func (q *RedisQueue) EnsureConsumerGroup(ctx context.Context) error {
	if q.client == nil {
		return nil
	}
	err := q.client.XGroupCreateMkStream(ctx, q.streamName, q.groupName, "$").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		return err
	}
	return nil
}

// PushLog appends a normalized log event into the stream with cap
func (q *RedisQueue) PushLog(ctx context.Context, service string, level string, payload string, maxLen int64) error {
	if q.client == nil {
		return nil
	}
	return q.client.XAdd(ctx, &redis.XAddArgs{
		Stream: q.streamName,
		MaxLen: maxLen,
		Approx: true,
		Values: map[string]interface{}{
			"service":   service,
			"level":     level,
			"payload":   payload,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		},
	}).Err()
}
