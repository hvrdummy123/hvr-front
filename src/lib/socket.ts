import { io } from "socket.io-client";
import { CHAT_URL } from "./api";
import { getToken } from "./auth";

export function createSocket() {
  return io(CHAT_URL, {
    // websocket only: works behind any load balancer without sticky sessions
    transports: ["websocket"],
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    // Called on every (re)connect attempt, so a reconnect after the 15-minute JWT expired just fetches a fresh one.
    auth: (cb) => {
      getToken()
        .then((token) => cb({ token: token ?? "" }))
        .catch(() => cb({ token: "" }));
    },
  });
}
