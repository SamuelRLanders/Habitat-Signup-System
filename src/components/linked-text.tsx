// Plain text with any http(s) URLs turned into links that open in a new
// tab. Line breaks are kept by the caller's whitespace-pre-line.

const URL_PATTERN = /(https?:\/\/[^\s<>"]+)/g;
// Punctuation that usually ends the sentence around a URL, not the URL.
const TRAILING_PUNCTUATION = /[.,;:!?)\]'"”’]+$/;

export function LinkedText({ text }: { text: string }) {
  return text.split(URL_PATTERN).map((part, index) => {
    // split() with a capture group puts the matches at the odd indexes.
    if (index % 2 === 0) return part;
    const trailing = part.match(TRAILING_PUNCTUATION)?.[0] ?? "";
    const url = part.slice(0, part.length - trailing.length);
    return (
      <span key={index}>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="break-all text-primary underline underline-offset-4"
        >
          {url}
        </a>
        {trailing}
      </span>
    );
  });
}
