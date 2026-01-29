import ConfirmEmailChangeClient from "./ConfirmEmailChangeClient";

export const dynamic = "force-dynamic";

export default async function ConfirmEmailChangePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams =
    (await (searchParams ?? Promise.resolve<Record<string, string | string[] | undefined>>({}))) || {};

  const getParam = (key: string) => {
    const value = resolvedSearchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const token = (getParam("token") || "").trim();
  return <ConfirmEmailChangeClient token={token} />;
}

