import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** ANY is the entry of a filter menu that filters nothing. */
const ANY = "";

/** FilterOption is one value a filter menu offers. */
export interface FilterOption {
  value: string;
  label: string;
  title?: string;
}

export interface FilterMenuProps {
  name: string;
  value: string;
  options: readonly FilterOption[];
  onChange: (value: string) => void;
}

/** FilterMenu picks one value of a filter, or Any. */
export function FilterMenu({ name, value, options, onChange }: FilterMenuProps) {
  const label = options.find((option) => option.value === value)?.label ?? "Any";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" />}
        aria-label={`${name}: ${label}`}
        className="max-w-48"
      >
        <span className="text-muted-foreground">{name}</span>
        <span className="min-w-0 truncate">{label}</span>
        <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          <DropdownMenuRadioItem value={ANY}>Any</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <span className="min-w-0 truncate" title={option.title}>
                {option.label}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
