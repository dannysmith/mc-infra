import type { FC } from "hono/jsx";

const tierStyles: Record<string, string> = {
  permanent: "bg-blue-bg text-blue",
  "semi-permanent": "bg-orange-bg text-orange",
  ephemeral: "bg-gray-bg text-text-muted",
};

const TierBadge: FC<{ tier: string }> = ({ tier }) => {
  const style = tierStyles[tier] ?? tierStyles.ephemeral;
  return (
    <span class={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>
      {tier}
    </span>
  );
};

export default TierBadge;
