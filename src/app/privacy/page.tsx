import Logo from "@/components/Logo";

export const metadata = { title: "Privacy · The Joie TV Reviews" };

export default function Privacy() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-10">
      <Logo height={34} />
      <h1 className="text-2xl font-bold">Privacy policy</h1>
      <p className="text-cream/80">
        reviews.thejoietv.com is a private portal where The Joie TV shares videos with clients and collaborators for feedback.
      </p>
      <h2 className="pt-2 text-lg font-semibold">What we collect</h2>
      <p className="text-cream/80">
        The name you are given or enter when opening a review link, and the comments you write. Your name is shown on the
        video as a watermark and next to your comments.
      </p>
      <h2 className="pt-2 text-lg font-semibold">How it is used</h2>
      <p className="text-cream/80">
        Only to run the review: showing feedback to The Joie TV team and to others reviewing the same video. We do not sell
        data, run ads, or use analytics trackers.
      </p>
      <h2 className="pt-2 text-lg font-semibold">Where it is stored</h2>
      <p className="text-cream/80">
        Videos are stored in The Joie TV&apos;s own Google Drive. Comments and client details are stored in Google Firestore.
        The site uses a cookie only to keep the team signed in and to remember the name you entered on a share link.
      </p>
      <h2 className="pt-2 text-lg font-semibold">Your data</h2>
      <p className="text-cream/80">
        To have your name or comments removed, ask The Joie TV contact who sent you the link.
      </p>
    </main>
  );
}
