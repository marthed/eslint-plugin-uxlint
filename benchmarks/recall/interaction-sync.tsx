// expect: INTERACTION-SYNC-001
import React from "react";

export function Bad() {
  const [isOpen, setIsOpen] = React.useState(false);
  const handleClick = () => setIsOpen(!isOpen);
  return <button onClick={handleClick}>Toggle</button>;
}

export function Good() {
  const [isOpen, setIsOpen] = React.useState(false);
  const handleClick = () => setIsOpen(!isOpen);
  return (
    <div>
      {isOpen && <p>Panel is open</p>}
      <button onClick={handleClick}>Toggle</button>
    </div>
  );
}
