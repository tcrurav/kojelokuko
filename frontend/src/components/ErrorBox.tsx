export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="error">
      {message}
    </p>
  ) : null;
}
