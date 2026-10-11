import { LoadingPage } from "../../../skeletons";
import { BuildsSkeleton } from "../../form-skeletons";

// The Overview tab.
export default function Loading() {
  return (
    <LoadingPage>
      <BuildsSkeleton />
    </LoadingPage>
  );
}
