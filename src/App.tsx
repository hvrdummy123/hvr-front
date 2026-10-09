import { AuthForm } from "./components/AuthForm";
import { Sidebar } from "./components/Sidebar";
import { Thread } from "./components/Thread";
import { authClient, clearToken } from "./lib/auth";
import { useChat } from "./useChat";
import { ResetPassword } from "./components/ResetPassword";

function ChatApp({ me }: { me: { id: string; name: string } }) {
  const chat = useChat(me.id);
  const active = chat.convs.find((c) => c.id === chat.activeId);

  return (
    <div className="app" data-view={active ? "thread" : "list"}>
      <Sidebar
        meName={me.name}
        convs={chat.convs}
        activeId={chat.activeId}
        online={chat.online}
        onOpen={chat.open}
        onStart={(id) => void chat.startWith(id)}
        onSignOut={async () => {
          clearToken();
          await authClient.signOut();
        }}
      />
      {active ? (
        <Thread
          conv={active}
          messages={chat.threads[active.id] ?? []}
          meId={me.id}
          online={chat.online}
          onSend={(body) => chat.send(active.id, body)}
          onRetry={chat.retry}
          onBack={chat.close}
        />
      ) : (
        <section className="thread empty">
          <p className="muted">Pick a conversation, or search for someone to start one.</p>
        </section>
      )}
    </div>
  );
}

function Main() {
  const { data, isPending } = authClient.useSession();
  if (isPending) return <main className="auth"><p className="muted">Loading…</p></main>;
  if (!data?.user) return <AuthForm />;
  return <ChatApp key={data.user.id} me={{ id: data.user.id, name: data.user.name }} />;
}

export default function App() {
  // The emailed reset link lands here (Vercel serves index.html for every path).
  if (window.location.pathname === "/reset-password") return <ResetPassword />;
  return <Main />;
}