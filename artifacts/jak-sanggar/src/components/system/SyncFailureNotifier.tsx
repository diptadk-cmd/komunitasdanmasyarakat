import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { subscribeDataSyncRejections } from "@/lib/sync";

export function SyncFailureNotifier() {
  useEffect(
    () =>
      subscribeDataSyncRejections((issue) => {
        toast({
          title: "Perubahan belum tersimpan di server",
          description: issue.error,
          variant: "destructive",
        });
      }),
    [],
  );

  return null;
}
