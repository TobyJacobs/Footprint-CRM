import PageHeader from "@/components/PageHeader";

export default function NoAccess({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="px-6 py-8 lg:px-10">
        <div className="max-w-xl rounded-lg border border-fp-border bg-white p-6">
          <p className="font-bold">You don&apos;t have access to this section</p>
          <p className="mt-1 text-sm text-fp-dark/75">
            If you need it for your work, ask an admin to add it to one of your roles.
          </p>
        </div>
      </div>
    </>
  );
}
