import Gate from "./Gate";
import HebrewStoryPartner from "./HebrewStoryPartner";

export default function Home() {
  return (
    <main style={{ padding: "2rem 1rem", minHeight: "100vh", background: "#e9ddc9" }}>
      <Gate>
        <HebrewStoryPartner />
      </Gate>
    </main>
  );
}
