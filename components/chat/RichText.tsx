import { Fragment } from "react";
import { parseRichText, type InlineToken } from "@/lib/chat/rich-text";

export type RichTextProps = {
  /** The assistant's reply, as the model wrote it. */
  content: string;
};

function Inline({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((token, index) =>
        token.bold ? (
          <strong key={index} className="font-medium text-ink-900">
            {token.text}
          </strong>
        ) : (
          <Fragment key={index}>{token.text}</Fragment>
        )
      )}
    </>
  );
}

/**
 * Renders the assistant's reply.
 *
 * Models answer in Markdown whether or not anyone asked, so printing the raw
 * string left asterisks on screen. This turns the subset described in
 * lib/chat/rich-text.ts into real elements — bold as `<strong>`, lists as
 * `<ul>`/`<ol>` — building React nodes rather than HTML, so nothing the model
 * writes can inject markup.
 */
export function RichText({ content }: RichTextProps) {
  const blocks = parseRichText(content);

  return (
    <div className="flex flex-col gap-2 text-sm text-ink-700">
      {blocks.map((block, index) => {
        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              key={index}
              className={
                block.ordered
                  ? "flex list-decimal flex-col gap-1 pl-5"
                  : "flex list-disc flex-col gap-1 pl-5"
              }
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inline tokens={item} />
                </li>
              ))}
            </List>
          );
        }

        return (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                <Inline tokens={line} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
