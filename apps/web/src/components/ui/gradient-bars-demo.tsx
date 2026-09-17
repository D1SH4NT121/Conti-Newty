import React from "react";
import Component from "./gradient-bars-background";

const settings = {
  numBars: 15,
  gradientColor: "rgb(255, 182, 12)",
};

export default function Demo(props: Partial<typeof settings>) {
  const s = { ...settings, ...props };
  return (
    <div className="h-screen w-screen">
      <Component numBars={s.numBars} gradientFrom={s.gradientColor} />
    </div>
  );
}
export { Demo };
