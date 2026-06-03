import Image from "next/image";

// page.tsx
export default function Home() {
  return (
    <div className="bg-background text-foreground">
      <h1 className="text-foreground">Hello World</h1>
      <p className="text-gray-600 dark:text-gray-400">
        このテキストはCSS変数を直接使っていません
      </p>
    </div>
  );
}
