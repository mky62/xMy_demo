import { Route, Routes } from "react-router-dom";
import ChatView from "./pages/ChatView";
import Home from "./pages/Home";

function App() {
  return (
    <div className="w-full h-screen overflow-hidden">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat/:roomId" element={<ChatView />} />
      </Routes>
    </div>
  );
}

export default App;