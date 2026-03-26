import { SpecialistCategoryInfo, Specialist } from "@/types/specialists";
import { SpecialistCard } from "./SpecialistCard";
import { cn } from "@/lib/utils";

interface CategorySectionProps {
  category: SpecialistCategoryInfo;
  specialists: Specialist[];
  onSpecialistClick?: (specialist: Specialist) => void;
}

export function CategorySection({ category, specialists, onSpecialistClick }: CategorySectionProps) {
  if (specialists.length === 0) return null;

  return (
    <section className="animate-fade-in">
      {/* Category Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl" role="img" aria-hidden="true">
          {category.emoji}
        </span>
        <h2 className="text-2xl font-bold text-foreground">
          {category.name}
        </h2>
      </div>

      {/* Specialist Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {specialists.map((specialist) => (
          <SpecialistCard
            key={specialist.id}
            specialist={specialist}
            onClick={() => onSpecialistClick?.(specialist)}
          />
        ))}
      </div>
    </section>
  );
}
