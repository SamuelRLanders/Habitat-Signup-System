import { LoadingPage } from "../../skeletons";
import { BuildsSkeleton, FormHeaderSkeleton } from "../form-skeletons";

// Opening a form from the list: the whole page while (tabs)/layout.tsx
// loads the form. Switching tabs keeps the header and shows only the tab's
// skeleton (the loading.tsx files under (tabs)).
export default function Loading() {
  return (
    <LoadingPage className="mx-auto flex max-w-6xl flex-col gap-8">
      <FormHeaderSkeleton />
      <BuildsSkeleton />
    </LoadingPage>
  );
}
