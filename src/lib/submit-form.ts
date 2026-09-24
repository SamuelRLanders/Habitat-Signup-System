import { startTransition, type FormEvent } from "react";

// An onSubmit handler that runs a useActionState action with the form's data.
// Use it instead of <form action={formAction}>, which makes React clear the
// form after every submission: here the answers stay put, so after an error
// the person fixes what's wrong instead of retyping everything.
export function submitForm(formAction: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };
}
