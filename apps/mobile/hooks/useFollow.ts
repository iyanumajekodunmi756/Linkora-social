import { useCallback, useState } from "react";

export const useFollow = (targetAddress: string) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const toggleFollow = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // TODO: Replace with real follow/unfollow contract call
      await new Promise((resolve) => setTimeout(resolve, 800));
      setIsFollowing((prev) => !prev);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Follow action failed"));
    } finally {
      setIsLoading(false);
    }
  }, [targetAddress]);

  return { isFollowing, isLoading, toggleFollow, error };
};
