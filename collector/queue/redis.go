package queue

import (
	"context"
	"github.com/redis/go-redis/v9"
)

type RedisBuffer struct {
	client *redis.Client
}

func NewRedisBuffer(redisURL string) (*RedisBuffer, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	client := redis.NewClient(opt)
	return &RedisBuffer{client: client}, nil
}

func (rb *RedisBuffer) PushRaw(ctx context.Context, key string, val string) error {
	return rb.client.Set(ctx, key, val, 0).Err()
}
