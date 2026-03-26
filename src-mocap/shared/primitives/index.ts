/**
 * UI Primitives
 * 
 * Universal UI components that work for both 2D and 3D applications.
 * Built on Radix UI primitives with consistent styling.
 */

// Core utilities
export { cn } from './cn';

// Dialog components
export {
    Dialog,
    DialogTrigger,
    DialogClose,
    DialogOverlay,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from './Dialog';

// Alert Dialog components
export {
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogCancel,
    AlertDialogAction,
    AlertDialogOverlay,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter
} from './AlertDialog';

// Button component
export { Button, type ButtonProps } from './Button';

// Slider components
export { Slider, type SliderProps } from './Slider';
export { ButterSlider, type ButterSliderProps } from './ButterSlider';

// Separator
export { Separator } from './Separator';

// Label
export { Label } from './Label';

// Scroll Area
export { ScrollArea, ScrollBar } from './ScrollArea';

// Dropdown Menu
export {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuRadioItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuGroup,
    DropdownMenuPortal,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuRadioGroup,
} from './DropdownMenu';

// Color picker
export { ColorPopover } from './ColorPopover';

// Checkbox
export { Checkbox } from './Checkbox';

// Select components
export {
    Select,
    SelectGroup,
    SelectValue,
    SelectTrigger,
    SelectContent,
    SelectLabel,
    SelectItem,
    SelectSeparator,
} from './Select';

// Toolbar components
export {
    Root as ToolbarRoot,
    Button as ToolbarButton,
    ToggleGroup as ToolbarToggleGroup,
    ToggleItem as ToolbarToggleItem,
    Separator as ToolbarSeparator,
    Group as ToolbarGroup,
    type ButtonProps as ToolbarButtonProps,
    type ToggleItemProps as ToolbarToggleItemProps
} from './Toolbar';

// Widgets
export { default as AlphaMenu } from './widgets/AlphaMenu';
export { KHDRWidget } from './widgets/KHDRWidget';
export { PerfHud } from './widgets/PerfHud';
