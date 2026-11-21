import PeopleManager from "@/components/admin/PeopleManager";
import { listPeople } from "@/lib/repo";
import { requireAdminPage } from "@/lib/session";

export default async function PeoplePage() {
  await requireAdminPage();
  const people = await listPeople();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Clients</h1>
      <PeopleManager people={people} />
    </div>
  );
}
