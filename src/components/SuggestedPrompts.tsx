const PROMPTS = [
  { icon: '📈', text: 'Act like a LinkedIn CEO and maximize hype.' },
  { icon: '🧹', text: 'Try to reduce technical debt without destroying morale.' },
  { icon: '💰', text: 'Maximize shareholder value by any means necessary.' },
  { icon: '🎓', text: 'Run this startup like a sensible CEO would.' },
  { icon: '🔥', text: 'Make the absolute worst possible strategic decisions.' },
  { icon: '😊', text: 'Focus entirely on keeping employees happy, cost be damned.' },
];

export default function SuggestedPrompts() {
  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
        💬 Suggested Agent Prompts
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        Copy a prompt into your AI agent or the Gemini inspector to let it run the company.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {PROMPTS.map((p) => (
          <button
            key={p.text}
            onClick={() => copy(p.text)}
            title="Click to copy"
            className="flex items-start gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-left text-xs text-gray-300 hover:border-gray-500 hover:bg-gray-750 hover:text-white transition-all duration-150 cursor-pointer group"
          >
            <span className="flex-shrink-0 mt-0.5">{p.icon}</span>
            <span className="leading-relaxed">{p.text}</span>
            <span className="ml-auto flex-shrink-0 text-gray-600 group-hover:text-gray-400 transition-colors">
              📋
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
