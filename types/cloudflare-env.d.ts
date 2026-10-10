// Bindings declared in wrangler.jsonc, as seen through getCloudflareContext().env.

type RateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

interface CloudflareEnv {
  RL_AUTH?: RateLimitBinding;
  RL_WRITE?: RateLimitBinding;
  RL_READ?: RateLimitBinding;
}
