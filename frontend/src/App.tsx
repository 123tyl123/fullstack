import axios from "axios";
import "./App.css";
import { useEffect, useState } from "react";
function App() {
  const [state, setSate] = useState<string | null>();
  useEffect(() => {
    const handleTestPage = async () => {
      const res = await axios.get("/api/test");
      setSate(res.data.message);
    };
    handleTestPage();
  }, []);
  return (
    <>
      <h1>{state}</h1>
    </>
  );
}

export default App;
