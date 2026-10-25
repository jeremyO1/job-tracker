import { PartyPopper } from "lucide-react";
import { useApp } from "../context/AppContext";
import AppCard from "../components/AppCard";
import { EmptyState, PageHeader } from "../components/ui";

export default function Offers() {
  const { applications } = useApp();
  const offers = applications.filter((a) => a.substate === "accepted");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Offers" subtitle="Applications that ended in a job offer." />
      {offers.length === 0 ? (
        <EmptyState icon={PartyPopper} title="No offers yet">They'll show up here as soon as one lands in your inbox.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((a) => <AppCard key={a.application_id} app={a} />)}
        </div>
      )}
    </div>
  );
}
