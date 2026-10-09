import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { strings } from '../../i18n/i18n';

/**
 * "View the repository" call to action, ported from the portfolio's
 * RepoButton: it shows the GitHub path derived from the full URL.
 */
@Component({
  selector: 'app-repo-button',
  templateUrl: './repo-button.html',
  styleUrl: './repo-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepoButton {
  readonly href = input.required<string>();

  protected readonly t = strings;
  protected readonly repoPath = githubRepoPath;
}

/** `https://github.com/user/repo/tree/x` -> `user/repo`. */
function githubRepoPath(url: string): string {
  return url
    .replace(/^https?:\/\/(www\.)?github\.com\//, '')
    .replace(/\/(tree|blob)\/.*$/, '')
    .replace(/\/$/, '');
}
