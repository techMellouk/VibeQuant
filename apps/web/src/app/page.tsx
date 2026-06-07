import { TopNav } from "@/components/TopNav";
import { ChatExperience } from "@/components/chat/ChatExperience";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <TopNav />
      <ChatExperience />
    </div>
  );
}
