// "Signal Network" — a sparse field of nodes connected by faint lines, with a handful of edges
// carrying a slow traveling pulse and a handful of nodes blinking in brand red. The concept is
// literal on purpose: this product's whole job is watching many channels — many signals — from
// one place, so the background reads as a live network rather than decorative clutter. Pure CSS
// animation, no client JS, so this renders as a server component.

const VIEW_W = 1000;
const VIEW_H = 600;
const NODE_COUNT = 52;

// Deterministic pseudo-random (no Math.random) so server- and client-rendered output match.
function seeded(seed: number): number {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return Math.abs(v - Math.floor(v));
}

interface NetworkNode {
  x: number;
  y: number;
  r: number;
  pulse: boolean;
  delay: number;
}

const NODES: NetworkNode[] = Array.from({ length: NODE_COUNT }, (_, i) => ({
  x: seeded(i * 2 + 1) * VIEW_W,
  y: seeded(i * 2 + 2) * VIEW_H,
  r: 1.6 + seeded(i * 3 + 1) * 1.6,
  pulse: i % 6 === 0,
  delay: seeded(i * 5 + 3) * 6,
}));

interface NetworkEdge {
  a: number;
  b: number;
  signal: boolean;
  delay: number;
}

// Each node connects to its two nearest neighbors — a sparse, elegant graph rather than a dense
// hairball. Every 7th edge carries the animated "signal" dash.
function buildEdges(): NetworkEdge[] {
  const edges: NetworkEdge[] = [];
  const seen = new Set<string>();
  NODES.forEach((node, i) => {
    const nearest = NODES.map((other, j) => ({
      j,
      d: i === j ? Infinity : Math.hypot(node.x - other.x, node.y - other.y),
    }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    nearest.forEach(({ j }) => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({ a: i, b: j, signal: edges.length % 7 === 0, delay: seeded(edges.length * 3 + 1) * 3 });
    });
  });
  return edges;
}

const EDGES = buildEdges();

export function BackgroundDecor() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="animated-gradient absolute inset-0" />

      <div className="animate-drift-a absolute -top-40 -left-40 h-80 w-80 rounded-full bg-brand/[0.07] blur-[100px]" />
      <div className="animate-drift-b absolute top-1/3 -right-40 h-72 w-72 rounded-full bg-brand/[0.06] blur-[100px]" />
      <div className="animate-drift-c absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-red-700/[0.08] blur-[100px]" />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <g stroke="white" strokeOpacity="0.05" strokeWidth="1">
          {EDGES.filter((e) => !e.signal).map((e, i) => (
            <line key={i} x1={NODES[e.a].x} y1={NODES[e.a].y} x2={NODES[e.b].x} y2={NODES[e.b].y} />
          ))}
        </g>
        <g fill="none" strokeWidth="1.2">
          {EDGES.filter((e) => e.signal).map((e, i) => (
            <line
              key={i}
              className="network-signal-edge"
              x1={NODES[e.a].x}
              y1={NODES[e.a].y}
              x2={NODES[e.b].x}
              y2={NODES[e.b].y}
              stroke="var(--brand)"
              strokeOpacity="0.4"
              style={{ animationDelay: `${e.delay}s` }}
            />
          ))}
        </g>
        {NODES.map((node, i) => (
          <circle
            key={i}
            cx={node.x}
            cy={node.y}
            r={node.r}
            className={node.pulse ? "network-node-pulse" : "network-node"}
            style={{ animationDelay: `${node.delay}s` }}
          />
        ))}
      </svg>
    </div>
  );
}
