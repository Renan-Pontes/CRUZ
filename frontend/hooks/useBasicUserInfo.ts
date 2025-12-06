import { useEffect, useState } from "react";
import { useSession } from "@/auth/ctx";
import { apiService } from "@/services/api";

export interface BasicUserInfo {
  username: string;
  email: string;
  xp: number;
  level: number;
  streak: number;
}

export function useBasicUserInfo() {
  const { session } = useSession();
  const [info, setInfo] = useState<BasicUserInfo>({
    username: "",
    email: "",
    xp: 0,
    level: 1,
    streak: 0,
  });
  const [loadingInfo, setLoadingInfo] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!session) {
        setLoadingInfo(false);
        return;
      }

      try {
        const me = await apiService.getMe(session);
        setInfo({
          username: me.username || "",
          email: me.email || "",
          xp: me.profile?.experience_points || 0,
          level: me.profile?.level || 1,
          streak: me.profile?.streak || 0,
        });
      } catch (e) {
        console.log("Falha ao buscar perfil básico", e);
      } finally {
        setLoadingInfo(false);
      }
    };

    load();
  }, [session]);

  return { info, loadingInfo, session };
}
