import { getInitData } from "@/lib/server-data";
import ContractApp from "./contract-app";

export const dynamic = "force-dynamic";

export default async function Page() {
  const initialData = await getInitData();
  return <ContractApp initialData={initialData} />;
}
