export default function PageHeader({
  title,
  intro,
}: {
  title: string;
  intro?: string;
}) {
  return (
    <div className="border-b border-fp-border bg-white px-6 py-8 lg:px-10">
      <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
      {intro && <p className="mt-2 max-w-2xl text-fp-dark/80">{intro}</p>}
    </div>
  );
}
