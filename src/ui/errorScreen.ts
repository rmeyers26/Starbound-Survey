// A friendly full-screen error with a Retry button (spec: "Errors and logging").
// Built with createElement/textContent (not innerHTML) so error text can never inject HTML.
export function showErrorScreen(
  container: HTMLElement,
  message: string,
  onRetry: () => void,
): void {
  container.replaceChildren();

  const box = document.createElement('div');
  box.className = 'error-screen';
  box.setAttribute('role', 'alert'); // screen readers announce it immediately

  const title = document.createElement('h1');
  title.textContent = 'Something went wrong';

  const text = document.createElement('p');
  text.textContent = message;

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Retry';
  button.addEventListener('click', onRetry);

  box.append(title, text, button);
  container.append(box);
}
