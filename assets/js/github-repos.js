(function () {
  'use strict';

  var GITHUB_USER = 'X3n0xs';
  var GITHUB_PROFILE = 'https://github.com/' + GITHUB_USER;

  var STATIC_REPOS = [
    {
      name: 'solar-exposure-analysis',
      description: 'Monthly solar exposure analysis for pedestrians using 360° panoramic images.',
      html_url: 'https://github.com/X3n0xs/solar-exposure-analysis',
      language: 'Python'
    },
    {
      name: 'zensvi-codes',
      description: 'Street-view analysis workflows and example scripts for urban measurement.',
      html_url: 'https://github.com/X3n0xs/zensvi-codes',
      language: 'Python'
    },
    {
      name: 'mpsfm-postprocess',
      description: 'Point clouds, panoramas, and localization after 3D reconstruction.',
      html_url: 'https://github.com/X3n0xs/mpsfm-postprocess',
      language: 'Python'
    }
  ];

  function esc(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function mergeRepo(staticRepo, apiRepo) {
    if (!apiRepo) return staticRepo;
    return {
      name: apiRepo.name || staticRepo.name,
      description: apiRepo.description || staticRepo.description,
      html_url: apiRepo.html_url || staticRepo.html_url,
      language: apiRepo.language || staticRepo.language,
      stargazers_count: apiRepo.stargazers_count,
      updated_at: apiRepo.updated_at
    };
  }

  function formatUpdated(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return '';
    }
  }

  function renderCard(repo) {
    var meta = [];
    if (repo.language) meta.push(repo.language);
    if (repo.stargazers_count > 0) meta.push('★ ' + repo.stargazers_count);
    if (repo.updated_at) meta.push('Updated ' + formatUpdated(repo.updated_at));

    return (
      '<article class="github-repo-card">' +
      '<h3 class="github-repo-card__title">' +
      '<a href="' +
      esc(repo.html_url) +
      '" rel="noopener noreferrer" target="_blank">' +
      esc(repo.name) +
      '</a></h3>' +
      '<p class="github-repo-card__text">' +
      esc(repo.description || 'Open repository on GitHub.') +
      '</p>' +
      (meta.length
        ? '<p class="github-repo-card__meta">' + esc(meta.join(' · ')) + '</p>'
        : '') +
      '<div class="github-repo-card__actions">' +
      '<a class="btn btn-github rounded-0 text-uppercase" href="' +
      esc(repo.html_url) +
      '" rel="noopener noreferrer" target="_blank">GitHub</a>' +
      '</div></article>'
    );
  }

  function renderGrid(repos) {
    return (
      '<div class="github-repo-grid row g-4 row-cols-1 row-cols-md-2 row-cols-lg-3">' +
      repos
        .map(function (repo) {
          return '<div class="col reveal">' + renderCard(repo) + '</div>';
        })
        .join('') +
      '</div>'
    );
  }

  function hydrateReveal(root) {
    if (!root || !('IntersectionObserver' in window)) return;
    root.querySelectorAll('.reveal').forEach(function (el) {
      if (el.classList.contains('is-visible')) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.classList.add('is-visible');
        return;
      }
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.05, rootMargin: '0px 0px 8% 0px' }
      );
      observer.observe(el);
    });
  }

  function renderTargets(repos) {
    document.querySelectorAll('[data-github-repos]').forEach(function (el) {
      el.innerHTML = renderGrid(repos);
      hydrateReveal(el);
    });
  }

  function fetchLiveRepos() {
    return fetch('https://api.github.com/users/' + GITHUB_USER + '/repos?sort=updated&per_page=100', {
      headers: { Accept: 'application/vnd.github+json' }
    })
      .then(function (res) {
        if (!res.ok) throw new Error('GitHub API ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!Array.isArray(data) || !data.length) return null;
        var byName = {};
        data.forEach(function (repo) {
          byName[repo.name] = repo;
        });
        return STATIC_REPOS.map(function (staticRepo) {
          return mergeRepo(staticRepo, byName[staticRepo.name]);
        });
      });
  }

  function init() {
    document.querySelectorAll('a[data-github-profile]').forEach(function (link) {
      link.href = GITHUB_PROFILE;
    });

    if (!document.querySelector('[data-github-repos]')) return;

    renderTargets(STATIC_REPOS);

    fetchLiveRepos()
      .then(function (repos) {
        if (repos) renderTargets(repos);
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
