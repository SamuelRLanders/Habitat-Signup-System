import { LoadingPage } from "../../skeletons";
import { EditorSkeleton } from "../form-skeletons";

// Without this, the forms list's skeleton would show here.
export default function Loading() {
  return (
    <LoadingPage>
      <EditorSkeleton />
    </LoadingPage>
  );
}
