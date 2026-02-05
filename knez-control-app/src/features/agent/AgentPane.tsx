import React, { useState, useRef } from 'react';

type AgentState = "IDLE" | "THINKING" | "ACTING" | "OBSERVING" | "FINISHED";

interface Step {
  id: number;
  type: "thought" | "action" | "observation";
  content: string;
  timestamp: number;
}

export const AgentPane: React.FC = () => {
  const [goal, setGoal] = useState("");
  const [state, setState] = useState<AgentState>("IDLE");
  const [steps, setSteps] = useState<Step[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const startAgent = async () => {
    if (!goal) return;
    setState("THINKING");
    setSteps([]);
    
    // Simulate Agent Loop for Demo (until backend supports autonomous mode fully)
    // Step 1: Think
    await addStep("thought", `Analyzing goal: "${goal}"... breaking down into subtasks.`);
    await delay(1000);
    
    // Step 2: Action
    setState("ACTING");
    await addStep("action", "Searching knowledge base for relevant context...");
    await delay(1500);
    
    // Step 3: Observation
    setState("OBSERVING");
    await addStep("observation", "Found 2 documents: 'Project Docs', 'API Keys'.");
    await delay(1000);
    
    // Step 4: Think
    setState("THINKING");
    await addStep("thought", "I have enough context. Formulating response.");
    await delay(1000);
    
    // Step 5: Finish
    setState("FINISHED");
    await addStep("thought", "Task completed. Ready for next command.");
  };

  const addStep = async (type: Step["type"], content: string) => {
    setSteps(prev => [...prev, { id: Date.now(), type, content, timestamp: Date.now() }]);
    setTimeout(() => scrollRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }), 100);
  };

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  return (
    <div className="flex flex-col h-full p-6 max-w-4xl mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-2">
          Autonomous Agent
        </h2>
        <p className="text-zinc-500 text-sm">Assign a high-level goal and let KNEZ execute the loop.</p>
      </div>

      <div className="flex gap-2 mb-8">
        <input 
          value={goal}
          onChange={e => setGoal(e.target.value)}
          placeholder="e.g., 'Research the latest Tauri v2 features and summarize them'"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
          disabled={state !== "IDLE" && state !== "FINISHED"}
        />
        <button
          onClick={startAgent}
          disabled={!goal || (state !== "IDLE" && state !== "FINISHED")}
          className={`px-6 py-3 rounded-lg font-bold transition-all ${
             state === "IDLE" || state === "FINISHED" 
             ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20' 
             : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          }`}
        >
          {state === "IDLE" || state === "FINISHED" ? "Start Task" : state}
        </button>
      </div>

      <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col relative">
         {/* Status Bar */}
         <div className="h-1 bg-zinc-900 w-full">
            {state !== "IDLE" && state !== "FINISHED" && (
              <div className="h-full bg-blue-500 animate-progress-indeterminate" />
            )}
         </div>
         
         {steps.length === 0 && (
           <div className="flex-1 flex items-center justify-center text-zinc-600 italic">
             Ready to accept tasks.
           </div>
         )}

         <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
            {steps.map(step => (
              <div key={step.id} className={`flex gap-4 ${step.type === 'action' ? 'pl-8' : step.type === 'observation' ? 'pl-16' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                   step.type === 'thought' ? 'bg-zinc-900 border-zinc-700 text-zinc-400' :
                   step.type === 'action' ? 'bg-blue-900/20 border-blue-800 text-blue-400' :
                   'bg-green-900/20 border-green-800 text-green-400'
                }`}>
                  {step.type === 'thought' ? '💭' : step.type === 'action' ? '⚡' : '👁'}
                </div>
                <div className="flex-1">
                  <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1">{step.type}</div>
                  <div className="text-zinc-200 text-sm leading-relaxed">{step.content}</div>
                </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};
