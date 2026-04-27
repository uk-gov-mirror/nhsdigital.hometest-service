import { type ComponentPropsWithoutRef, forwardRef } from "react";

export type ImportantInsetTextProps = ComponentPropsWithoutRef<"div">;

export const ImportantInsetText = forwardRef<HTMLDivElement, ImportantInsetTextProps>(
  ({ className, children, ...rest }, forwardedRef) => (
    <div
      className={className ? `nhsuk-inset-text ${className}` : "nhsuk-inset-text"}
      ref={forwardedRef}
      {...rest}
    >
      <span className="nhsuk-u-visually-hidden">Important Information: </span>
      {children}
    </div>
  ),
);

ImportantInsetText.displayName = "ImportantInsetText";
