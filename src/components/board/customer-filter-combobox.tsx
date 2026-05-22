"use client";

import { useState } from "react";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type CustomerOption = {
  id: string;
  username: string;
};

export function CustomerFilterCombobox({
  customers,
  value,
  onValueChange,
  placeholder = "Select customer…",
}: {
  customers: CustomerOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = customers.find((customer) => customer.id === value);

  return (
    <div className="space-y-2">
      <Label>Customer</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {selected ? selected.username : placeholder}
            </span>
            <CaretDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search customers…" />
            <CommandList>
              <CommandEmpty>No customer found.</CommandEmpty>
              <CommandGroup>
                {customers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.username}
                    onSelect={() => {
                      onValueChange(customer.id);
                      setOpen(false);
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "size-4",
                        value === customer.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {customer.username}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function CustomerFilterMultiCombobox({
  customers,
  selected,
  onSelectedChange,
}: {
  customers: CustomerOption[];
  selected: string[];
  onSelectedChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabels = customers
    .filter((customer) => selected.includes(customer.id))
    .map((customer) => customer.username);

  return (
    <div className="space-y-2">
      <Label>Customers</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-auto min-h-9 w-full justify-between py-2 font-normal"
          >
            <span className="truncate text-left">
              {selectedLabels.length > 0
                ? selectedLabels.join(", ")
                : "Select customers…"}
            </span>
            <CaretDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search customers…" />
            <CommandList>
              <CommandEmpty>No customer found.</CommandEmpty>
              <CommandGroup>
                {customers.map((customer) => {
                  const isSelected = selected.includes(customer.id);
                  return (
                    <CommandItem
                      key={customer.id}
                      value={customer.username}
                      onSelect={() => {
                        onSelectedChange(
                          isSelected
                            ? selected.filter((id) => id !== customer.id)
                            : [...selected, customer.id],
                        );
                      }}
                    >
                      <CheckIcon
                        className={cn(
                          "size-4",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {customer.username}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
