/** One modular slot. Acquisition is lazy; no other Storage capability is exposed. */
export const current_save_key = "city-of-vice-modular-current-v1";
export type Storage_port = Pick<Storage, "getItem" | "setItem">;
export type Storage_failure = {
  status: "unavailable";
  stage: "acquire" | "read" | "write";
};
export function local_persistence(
  acquire: () => Storage_port = () => window.localStorage,
) {
  return {
    read(): { status: "read"; value: string | null } | Storage_failure {
      let storage: Storage_port;
      try {
        storage = acquire();
      } catch {
        return { status: "unavailable", stage: "acquire" };
      }
      try {
        return { status: "read", value: storage.getItem(current_save_key) };
      } catch {
        return { status: "unavailable", stage: "read" };
      }
    },
    write(value: string): { status: "written" } | Storage_failure {
      let storage: Storage_port;
      try {
        storage = acquire();
      } catch {
        return { status: "unavailable", stage: "acquire" };
      }
      try {
        storage.setItem(current_save_key, value);
        return { status: "written" };
      } catch {
        return { status: "unavailable", stage: "write" };
      }
    },
  };
}
